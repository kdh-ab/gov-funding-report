import { spawn } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const REGION_MAP: Record<string, string> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
};

function extractRegion(address: string): string {
  for (const [short, full] of Object.entries(REGION_MAP)) {
    if (address.includes(full) || address.startsWith(short)) return full;
  }
  return "";
}

export async function POST(request: Request) {
  const { formData, refresh } = await request.json();

  if (!formData?.company_name) {
    return Response.json({ error: "기업명은 필수입니다." }, { status: 400 });
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const companiesDir = path.join(projectRoot, "data", "companies");
  await mkdir(companiesDir, { recursive: true });

  // 기업 프로필 저장
  const profile = { ...formData, region: extractRegion(formData.address || "") };
  const safeName = formData.company_name.replace(/[^\w가-힣]/g, "_");
  const profilePath = path.join(companiesDir, `${safeName}.json`);
  await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");

  // Python 프로세스를 스트리밍으로 실행
  const args = [path.join(projectRoot, "run_match.py"), formData.company_name];
  if (refresh) args.push("--refresh");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn("python3", args, {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";

      const timeout = setTimeout(() => {
        proc.kill();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: "크롤링 시간이 초과되었습니다." })}\n\n`
          )
        );
        controller.close();
      }, refresh ? 300000 : 30000);

      // stderr → 진행 상황 스트리밍
      let stderrBuf = "";
      proc.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString();
        const lines = stderrBuf.split("\n");
        stderrBuf = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/\[PROGRESS\] (\w+)\|(.+)/);
          if (match) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "progress", step: match[1], message: match[2] })}\n\n`
              )
            );
          }
        }
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timeout);
        // flush remaining stderr
        if (stderrBuf) {
          const match = stderrBuf.match(/\[PROGRESS\] (\w+)\|(.+)/);
          if (match) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "progress", step: match[1], message: match[2] })}\n\n`
              )
            );
          }
        }

        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "result", data: result })}\n\n`
              )
            );
          } catch {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "결과 파싱 실패" })}\n\n`
              )
            );
          }
        } else if (!stdout) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: `프로세스 종료 코드: ${code}` })}\n\n`
            )
          );
        }
        controller.close();
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`
          )
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
