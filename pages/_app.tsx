/**
 * The _app component is the top-level component wrapping all pages
 * in the application.
 *
 * @author Ajay Gandecha <agandecha@unc.edu>
 * @license MIT
 * @see https://comp426-25f.github.io/
 */

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { api } from "@/utils/trpc/api";

function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="auto"
      enableSystem
      disableTransitionOnChange
    >
      <Component {...pageProps} />
      <Toaster richColors closeButton />
    </ThemeProvider>
  );
}

export default api.withTRPC(App);
