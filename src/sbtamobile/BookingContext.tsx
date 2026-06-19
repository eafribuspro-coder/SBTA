import { createContext, useContext, useState, ReactNode } from 'react';
import { Passenger, TripOption } from './api';
import { TimeSlot } from './theme';

type SearchCriteria = {
  originCityId: string;
  originName: string;
  originStationId: string;
  originStationName: string;
  destCityId: string;
  destName: string;
  destStationId: string;
  destStationName: string;
  date: string;
  slot: TimeSlot;
};

type BookingDraft = {
  search: SearchCriteria | null;
  trip: TripOption | null;
  seatsCount: number;
  passengers: Passenger[];
  paymentMethod: string;
  paymentPhone: string;
  serviceFee: number;
};

type BookingContextValue = {
  draft: BookingDraft;
  setSearch: (s: SearchCriteria) => void;
  setTrip: (t: TripOption) => void;
  setSeatsCount: (n: number) => void;
  setPassengers: (p: Passenger[]) => void;
  setPayment: (method: string, phone: string) => void;
  setServiceFee: (fee: number) => void;
  reset: () => void;
};

const emptyDraft: BookingDraft = {
  search: null,
  trip: null,
  seatsCount: 1,
  passengers: [],
  paymentMethod: '',
  paymentPhone: '',
  serviceFee: 300,
};

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);

  return (
    <BookingContext.Provider
      value={{
        draft,
        setSearch: (search) => setDraft((d) => ({ ...d, search })),
        setTrip: (trip) => setDraft((d) => ({ ...d, trip })),
        setSeatsCount: (seatsCount) => setDraft((d) => ({ ...d, seatsCount })),
        setPassengers: (passengers) => setDraft((d) => ({ ...d, passengers })),
        setPayment: (paymentMethod, paymentPhone) =>
          setDraft((d) => ({ ...d, paymentMethod, paymentPhone })),
        setServiceFee: (serviceFee) => setDraft((d) => ({ ...d, serviceFee })),
        reset: () => setDraft(emptyDraft),
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
