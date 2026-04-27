export function ContactRow({ contact }: { contact: string }) {
  const phones = contact.match(/\d{2,4}-\d{3,4}-\d{4}/g) || [];
  const emails = contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  let orgName = contact;
  for (const p of phones) orgName = orgName.replace(p, "");
  for (const e of emails) orgName = orgName.replace(e, "");
  orgName = orgName.replace(/[,\s]+/g, " ").trim();

  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-20 text-slate-500 font-medium">연락처</span>
      <div className="flex-1 space-y-1">
        {orgName && <p className="text-slate-800">{orgName}</p>}
        {phones.map((p, i) => (
          <a key={i} href={`tel:${p}`} className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-400">
              <path d="M6 3H4a1 1 0 00-1 1v1a9 9 0 009 9h1a1 1 0 001-1v-2l-3-1.5-1 1a5 5 0 01-3-3l1-1L6 3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {p}
          </a>
        ))}
        {emails.map((e, i) => (
          <a key={i} href={`mailto:${e}`} className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-slate-400">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {e}
          </a>
        ))}
      </div>
    </div>
  );
}
