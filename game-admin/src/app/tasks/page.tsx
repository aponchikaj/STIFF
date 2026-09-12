import type { Metadata } from "next";
import { TasksTab } from "@/components/game/tasks-tab";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return (
    <section className="py-10">
      <TasksTab />
    </section>
  );
}
