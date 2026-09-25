import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_NOUS_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yjepvpflamlncpgncsun.supabase.co";

const key =
  process.env.NEXT_PUBLIC_NOUS_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_m9I76Yiymq9k7ZA43FvLDg_Z0mpnZBO";

export const isNousCloudConfigured=Boolean(url&&key);

export const nousSupabase=isNousCloudConfigured
  ? createClient(url as string,key as string,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storageKey:"nous-couple-auth-v1"
      }
    })
  : null;

export type NousItemKind="shopping"|"task"|"idea"|"trip"|"note";
export type NousAssignee="owner"|"member"|"both";

export type NousMember={
  userId:string;
  displayName:string;
  role:"owner"|"member";
};

export type NousItem={
  id:string;
  household_id?:string;
  kind:NousItemKind;
  title:string;
  details?:string|null;
  due_at?:string|null;
  assignee:NousAssignee;
  done:boolean;
  pinned:boolean;
  created_at:string;
  updated_at?:string;
};

export type NousEvent={
  id:string;
  household_id?:string;
  title:string;
  starts_at:string;
  ends_at?:string|null;
  location?:string|null;
  details?:string|null;
  assignee:NousAssignee;
  created_at:string;
};

export type NousSpace={
  householdId:string;
  householdName:string;
  memberName:string;
  role:"owner"|"member";
  inviteCode?:string|null;
  members:NousMember[];
};

export async function getNousUser(){
  if(!nousSupabase) return null;
  const {data}=await nousSupabase.auth.getSession();
  return data.session?.user??null;
}

export async function sendNousMagicLink(email:string){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const redirectTo=typeof window!=="undefined"?`${window.location.origin}/nous`:undefined;
  const {error}=await nousSupabase.auth.signInWithOtp({
    email,
    options:{
      emailRedirectTo:redirectTo,
      shouldCreateUser:true
    }
  });
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function signOutNous(){
  if(!nousSupabase) return;
  await nousSupabase.auth.signOut();
}

export async function loadNousSpace():Promise<NousSpace|null>{
  if(!nousSupabase) return null;
  const user=await getNousUser();
  if(!user) return null;

  const {data:membership,error}=await nousSupabase
    .from("household_members")
    .select("household_id,display_name,role")
    .eq("user_id",user.id)
    .limit(1)
    .maybeSingle();

  if(error||!membership) return null;

  const [{data:household},{data:members}]=await Promise.all([
    nousSupabase
      .from("households")
      .select("id,name,invite_code")
      .eq("id",membership.household_id)
      .single(),
    nousSupabase
      .from("household_members")
      .select("user_id,display_name,role")
      .eq("household_id",membership.household_id)
      .order("joined_at",{ascending:true})
  ]);

  if(!household) return null;

  return {
    householdId:household.id,
    householdName:household.name,
    memberName:membership.display_name,
    role:membership.role as "owner"|"member",
    inviteCode:household.invite_code,
    members:(members??[]).map(m=>({
      userId:m.user_id,
      displayName:m.display_name,
      role:m.role as "owner"|"member"
    }))
  };
}

export async function createNousSpace(name:string,displayName:string){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {data,error}=await nousSupabase.rpc("create_household",{
    household_name:name,
    display_name:displayName
  });
  return error?{ok:false,reason:error.message}:{ok:true,data};
}

export async function joinNousSpace(inviteCode:string,displayName:string){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {data,error}=await nousSupabase.rpc("join_household_by_code",{
    invite_code_input:inviteCode.trim().toUpperCase(),
    display_name:displayName
  });
  return error?{ok:false,reason:error.message}:{ok:true,data};
}

export async function loadNousData(householdId:string){
  if(!nousSupabase) return {items:[] as NousItem[],events:[] as NousEvent[]};
  const [itemsRes,eventsRes]=await Promise.all([
    nousSupabase.from("household_items")
      .select("id,household_id,kind,title,details,due_at,assignee,done,pinned,created_at,updated_at")
      .eq("household_id",householdId)
      .order("created_at",{ascending:false}),
    nousSupabase.from("household_events")
      .select("id,household_id,title,starts_at,ends_at,location,details,assignee,created_at")
      .eq("household_id",householdId)
      .order("starts_at",{ascending:true})
  ]);
  return {
    items:(itemsRes.data??[]) as NousItem[],
    events:(eventsRes.data??[]) as NousEvent[]
  };
}

export async function addNousItem(
  householdId:string,
  input:Omit<NousItem,"id"|"created_at"|"household_id">
){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {error}=await nousSupabase.from("household_items").insert({
    household_id:householdId,
    ...input
  });
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function updateNousItem(id:string,patch:Partial<NousItem>){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {error}=await nousSupabase
    .from("household_items")
    .update({...patch,updated_at:new Date().toISOString()})
    .eq("id",id);
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function deleteNousItem(id:string){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {error}=await nousSupabase.from("household_items").delete().eq("id",id);
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function addNousEvent(
  householdId:string,
  input:Omit<NousEvent,"id"|"created_at"|"household_id">
){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {error}=await nousSupabase.from("household_events").insert({
    household_id:householdId,
    ...input
  });
  return error?{ok:false,reason:error.message}:{ok:true};
}

export async function deleteNousEvent(id:string){
  if(!nousSupabase) return {ok:false,reason:"cloud_not_configured" as const};
  const {error}=await nousSupabase.from("household_events").delete().eq("id",id);
  return error?{ok:false,reason:error.message}:{ok:true};
}

export function subscribeNous(householdId:string,onChange:()=>void){
  if(!nousSupabase) return ()=>{};
  const channel=nousSupabase
    .channel(`nous-${householdId}`)
    .on("postgres_changes",{
      event:"*",
      schema:"public",
      table:"household_items",
      filter:`household_id=eq.${householdId}`
    },onChange)
    .on("postgres_changes",{
      event:"*",
      schema:"public",
      table:"household_events",
      filter:`household_id=eq.${householdId}`
    },onChange)
    .on("postgres_changes",{
      event:"*",
      schema:"public",
      table:"household_members",
      filter:`household_id=eq.${householdId}`
    },onChange)
    .subscribe();

  return ()=>{void nousSupabase.removeChannel(channel);};
}
