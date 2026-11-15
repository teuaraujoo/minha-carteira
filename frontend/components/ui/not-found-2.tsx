import Image from "next/image";
import Link from "next/link";
import { HomeIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function NotFound() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
      />

      <Empty className="relative z-10 max-w-lg">
        <EmptyHeader>
          <Image
            src="/favicon.png"
            alt="Minha Carteira"
            width={40}
            height={40}
            className="mb-2 h-10 w-auto object-contain"
            priority
          />

          <EmptyTitle className="mask-b-from-20% mask-b-to-80% text-9xl font-extrabold tracking-tight text-primary">
            404
          </EmptyTitle>

          <EmptyDescription className="-mt-6 text-foreground/80">
            A página que você procura pode ter sido <br />
            movida ou não existe.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "default" }), "rounded-lg")}
          >
            <HomeIcon className="size-4" data-icon="inline-start" />
            Voltar para o início
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
