import { redirect } from 'next/navigation';

/** `/admin/panel` без сегмента ведёт на «Утро» (ТЗ §2). */
export default function PanelIndex() {
    redirect('/admin/panel/morning');
}
