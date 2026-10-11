import Link from 'next/link';
import { IronMilesMark } from '@/components/brand/IronMilesLogo';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="im-grain flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <IronMilesMark height={40} title="Iron Miles" />
      <p className="im-eyebrow mt-9">404</p>
      <h1 className="im-display mt-5 text-[clamp(2.2rem,7vw,4rem)]">Wrong turn.</h1>
      <p className="mt-5 max-w-[42ch] text-[15px] leading-relaxed text-muted">
        This page is not on the route. Head back to the start and pick it up again.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back to the start</ButtonLink>
        <ButtonLink href="/app" variant="ghost">
          Open the hub
        </ButtonLink>
      </div>
      <p className="mt-8 text-[12px] text-muted-2">
        Looking for the main site?{' '}
        <Link href="https://ironmiles.ie" className="text-white underline underline-offset-4 hover:text-green">
          ironmiles.ie
        </Link>
      </p>
    </main>
  );
}
