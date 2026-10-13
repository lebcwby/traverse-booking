export function ConfirmationCode({ code }: { code: string }) {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">Confirmation Code</p>
      <p className="font-mono text-lg font-semibold">{code}</p>
    </div>
  );
}
