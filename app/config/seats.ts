export const seatConfig = {
  // Number of seats allocated to each priority tier
  seatsPerTier: {
    3: 2,  // VIP: 20 seats
    2: 1,  // Close friends: 30 seats
    1: 1,  // Colleagues: 40 seats
    0: 2   // General: 50 seats
  } as const,

  // Map invitation codes to priority levels
  codeToPriority: {
    '3': 3,
    '2': 2,
    '1': 1,
    '0': 0
  } as const,

  // Default priority when no code is provided
  defaultPriority: 0
} as const;

export function getTierName(priority: number): string {
  switch (priority) {
    case 3: return "VIP";
    case 2: return "Close Friends";
    case 1: return "Colleagues";
    case 0: return "General";
    default: return `Tier ${priority}`;
  }
}

export type PriorityLevel = keyof typeof seatConfig.seatsPerTier;
export type InvitationCode = keyof typeof seatConfig.codeToPriority;

export function getPriorityFromCode(code: string | null): number {
  if (!code) return seatConfig.defaultPriority;
  return seatConfig.codeToPriority[code as InvitationCode] ?? seatConfig.defaultPriority;
}

export function getMaxSeatsForPriority(priority: number): number {
  // Calculate cumulative seats from lowest priority (0) up to and including this priority level
  let totalSeats = 0;
  for (let p = 0; p <= priority; p++) {
    totalSeats += seatConfig.seatsPerTier[p as PriorityLevel] ?? 0;
  }
  return totalSeats;
}

export function getSeatsInTier(priority: number): number {
  return seatConfig.seatsPerTier[priority as PriorityLevel] ?? 0;
}
