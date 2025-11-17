/**
 * Home page template.
 */

import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";

export default function HomePage() {
  
  return (
    <div className="flex flex-col gap-3 p-8">
      <p className="text-2xl font-bold">COMP 426 Final Project Template</p>
      <p className="text-muted-foreground">
        If you have any questions, please find us in office hours!
      </p>
    </div>
  )
}

// The `getServerSideProps` function is used to fetch the user data and on
// the server side before rendering the page to both pre-load the Supabase
// user and profile data. If the user is not logged in, we can catch this
// here and redirect the user to the login page.
export async function getServerSideProps(context: GetServerSidePropsContext) {
  // Create the supabase context that works specifically on the server and
  // pass in the context.
  const supabase = createSupabaseServerClient(context);

  // Attempt to load the user data
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  // If the user is not logged in, redirect them to the login page.
  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  // Return the user and profile as props.
  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}