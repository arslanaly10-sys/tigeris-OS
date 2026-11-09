import { redirect } from "next/navigation";
/** The front door is the client's briefing welcome (brief v3, golden path step 0). */
export default function Home() {
  redirect("/welcome");
}
