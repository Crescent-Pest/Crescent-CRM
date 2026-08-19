/** Field tools (capture / history / notes) came from the Crescent-Inspect app
 * and are designed phone-first — keep them in a narrow column on desktop. */
export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto w-full max-w-xl">{children}</div>;
}
