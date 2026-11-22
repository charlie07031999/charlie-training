// Parse only a fresh Supabase email verification link. Never navigate to or log it.
export function parseRecoveryLink(input:string, supabaseUrl:string){
  const link=new URL(input.trim());
  const expected=new URL(supabaseUrl);
  const type=link.searchParams.get('type');
  const token_hash=link.searchParams.get('token')??link.searchParams.get('token_hash');
  if(link.origin!==expected.origin||link.pathname!=='/auth/v1/verify'||link.username||link.password||!token_hash||type!=='magiclink'){
    throw new Error('Copie le lien de connexion original du dernier email, sans l’ouvrir.');
  }
  return {token_hash,type:'magiclink' as const};
}
