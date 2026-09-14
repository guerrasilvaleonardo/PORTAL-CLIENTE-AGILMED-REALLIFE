import { supabase } from '@/lib/supabase';
import { obterMarca, type Marca } from '@/lib/marca';

export async function obterMarcaDaEmpresa(): Promise<Marca> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return 'agilmed';
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single();

  if (!perfil?.empresa_id) {
    return 'agilmed';
  }

  const { data: empresa } = await supabase
    .from('empresas')
    .select('marca')
    .eq('id', perfil.empresa_id)
    .single();

  return obterMarca(empresa?.marca);
}
