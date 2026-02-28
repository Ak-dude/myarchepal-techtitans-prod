import { Separator } from '@/components/ui/separator';
import type { TemplateField } from '@/types/siteTemplates';

/** Handles fieldType: section_header | divider */
export default function SectionHeaderField({ field }: { field: TemplateField }) {
  if (field.fieldType === 'divider') {
    return <Separator className="my-2" />;
  }
  return (
    <div className="pt-2 pb-1">
      <p className="text-sm font-semibold text-foreground">{field.label}</p>
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}
