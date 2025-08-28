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

export interface TierData {
  priority: number;
  tierName: string;
  currentSeats: number;
  maxSeats: number;
  available: number;
  percentage: number;
  cumulativeMax: number;
  cumulativeCurrent: number;
  cumulativeAvailable: number;
}

export interface AdminLoaderData {
  tiers: TierData[];
  totalRegistrants: number;
  totalMaxSeats: number;
  totalAvailable: number;
  error?: string;
}
