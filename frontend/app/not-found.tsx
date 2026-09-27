import { Poppins, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import styles from "./not-found.module.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-not-found-display",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-not-found-body",
  weight: ["400", "600", "700"],
});

export default function NotFound() {
  return (
    <main
      className={`${spaceGrotesk.variable} ${poppins.variable} ${styles.shell}`}
    >
      <section className={styles.panel} aria-labelledby="not-found-title">
        <div className={styles.brandMark}>
          <Image
            className={styles.logo}
            src="/favicon.png"
            alt="Minha Carteira"
            width={148}
            height={768}
            sizes="(max-width: 640px) 11rem, 16rem"
            priority
          />
        </div>

        <div className={styles.content}>
          <p className={styles.eyebrow}>Página não encontrada</p>

          <h1
            id="not-found-title"
            className={styles.errorCode}
            aria-label="Erro 404"
          >
            <span aria-hidden="true">4</span>
            <span className={styles.zero} aria-hidden="true">
              0
            </span>
            <span aria-hidden="true">4</span>
          </h1>

          <div className={styles.message}>
            <p>Desculpe, não encontramos</p>
            <p>nada por aqui.</p>
          </div>

          <p className={styles.description}>
            O endereço pode estar incorreto ou a página pode ter sido movida.
          </p>

          <Link className={styles.homeLink} href="/">
            Voltar para o início
          </Link>
        </div>
      </section>
    </main>
  );
}
