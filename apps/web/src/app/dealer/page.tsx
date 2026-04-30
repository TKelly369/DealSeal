import { redirect } from "next/navigation";

/** Role home for dealer staff; dashboard remains the primary workspace surface. */
export default function DealerHomePage() {
  redirect("/dealer/dashboard");
}
