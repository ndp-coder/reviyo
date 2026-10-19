import { legal } from '@/config/legal';
import { buttonClasses } from '@/components/ui/button-styles';

/** Opens a visitor's phone or mail app; never sends a message automatically. */
export function SetupSupportLinks() {
  return <div className="setup-support-links flex flex-wrap gap-3">
    <a href={`tel:${legal.supportPhone.replace(/\s+/g, '')}`} className={buttonClasses({ variant: 'outline' })}>Call setup support</a>
    <a href={`mailto:${legal.supportEmail}?subject=${encodeURIComponent('Help setting up Reviyo')}`} className={buttonClasses({ variant: 'outline' })}>Email setup support</a>
  </div>;
}
