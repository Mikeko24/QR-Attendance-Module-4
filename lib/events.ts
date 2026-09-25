import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by?: string | null;
  created_at?: string;
};

export async function createEvent(event: Event) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { data: null, error: authError ?? new Error('You must be signed in.') };
  }

  return supabase
    .from('events')
    .upsert(
      {
        event_code: event.eventId,
        title: event.title,
        start_time: event.start,
        end_time: event.end,
        created_by: authData.user.id,
      },
      { onConflict: 'event_code' }
    )
    .select('*')
    .single();
}

export async function getEventsByTeacher(teacherId: string): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as CloudEvent[]);
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();
  return error ? null : (data as CloudEvent | null);
}
