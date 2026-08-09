import { AsteriskMark } from "@/components/asterisk-mark";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-32" role="status">
      <AsteriskMark className="animate-spin-slow size-10 text-muted" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
