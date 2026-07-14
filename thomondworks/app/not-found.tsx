import Link from "next/link";
import { BridgeMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <section className="container-tw flex min-h-[80svh] flex-col items-center justify-center py-40 text-center">
      <BridgeMark className="h-16 w-auto opacity-40" variant="mono" />
      <p className="label label--bronze mt-10">404</p>
      <h1 className="display mt-6 text-[length:var(--text-h2)]">
        This bridge doesn&apos;t go anywhere.
      </h1>
      <p className="lede mx-auto mt-6">
        The page you&apos;re after has moved, or never existed. The river keeps going,
        though.
      </p>
      <Link href="/" className="btn btn--primary mt-10" data-magnetic>
        Back to Solid Ground
        <span className="btn-arrow" aria-hidden>
          →
        </span>
      </Link>
    </section>
  );
}
