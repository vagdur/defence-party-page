import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

export namespace Route {
  export type MetaArgs = {
    data: any;
    params: any;
    location: any;
  };

  export type LoaderArgs = LoaderFunctionArgs;
  export type ActionArgs = ActionFunctionArgs;
  export type ComponentProps = {
    data: any;
  };
}
