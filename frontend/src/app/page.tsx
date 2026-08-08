import { AsteriskMark } from "@/components/asterisk-mark";

export default function Home() {
  return (
    <section className="flex h-[85svh] flex-col items-center justify-center px-6">
      <div className="flex items-center gap-4 sm:gap-6">
        <AsteriskMark className="size-16 sm:size-28" />
        <h1 className="text-7xl uppercase leading-none tracking-tight sm:text-9xl">
          Stiff
        </h1>
      </div>
    </section>
  );
}
