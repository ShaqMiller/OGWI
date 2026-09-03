export interface PumpEventRecord {
  amount: number;
  effectiveAt: Date;
}

export interface FlightState {
  flightId: string | null;
  fill: number;
  isAirborne: boolean;
  peak: number;
  liftoffAt: Date | null;
  justTouchedDown: boolean;
}
