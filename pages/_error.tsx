import { NextPageContext } from "next";

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center text-foreground">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">
          {statusCode
            ? `The server responded with status code ${statusCode}.`
            : "An unexpected client error occurred."}
        </p>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
