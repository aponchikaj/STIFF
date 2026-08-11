import { AsteriskMark } from "@/components/asterisk-mark";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-32" role="status">
      <span className="animate-asterisk-breathe">
        <AsteriskMark className="animate-asterisk-tick size-10 text-muted" />
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
