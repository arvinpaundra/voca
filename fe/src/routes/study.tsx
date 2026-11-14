import { createFileRoute } from "@tanstack/react-router";
import { StudyPage } from "../features/study/StudyPage";

export const Route = createFileRoute("/study")({
  component: StudyPage,
});
