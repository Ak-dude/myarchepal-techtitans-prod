import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { FieldComponentProps } from './_types';
import type { TemplateField } from '@/types/siteTemplates';

type RowData = Record<string, unknown>;

/** Inline row editor for a single group row */
function RowEditor({
  groupFields,
  initial,
  onSave,
  onCancel,
}: {
  groupFields: Omit<TemplateField, 'groupFields'>[];
  initial: RowData;
  onSave: (data: RowData) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<RowData>({ defaultValues: initial });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-3 p-3 bg-muted/40 rounded-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groupFields.map(gf => (
          <div key={gf.id} className="space-y-1">
            <Label htmlFor={`row-${gf.id}`} className="text-xs">{gf.label}</Label>
            {gf.fieldType === 'textarea' ? (
              <Textarea id={`row-${gf.id}`} rows={2} {...register(gf.id)} />
            ) : (
              <Input
                id={`row-${gf.id}`}
                type={gf.fieldType === 'date' ? 'date' : gf.fieldType === 'number' ? 'number' : 'text'}
                {...register(gf.id)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save Row</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

/** Handles fieldType: repeating_group */
export default function RepeatingGroupField({ field, control, mode }: FieldComponentProps) {
  const groupFields = (field.groupFields ?? []) as Omit<TemplateField, 'groupFields'>[];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const disabled = mode === 'preview';

  const toggleRow = (i: number) =>
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? []}
      render={({ field: rhf }) => {
        const rows: RowData[] = Array.isArray(rhf.value) ? (rhf.value as RowData[]) : [];

        const saveRow = (i: number, data: RowData) => {
          const next = [...rows];
          next[i] = data;
          rhf.onChange(next);
          setEditingIndex(null);
        };

        const addRow = (data: RowData) => {
          rhf.onChange([...rows, data]);
          setAddingNew(false);
        };

        const deleteRow = (i: number) => {
          rhf.onChange(rows.filter((_, idx) => idx !== i));
        };

        // Summary label — first group field value or "Row N"
        const rowSummary = (row: RowData, i: number) => {
          const firstKey = groupFields[0]?.id;
          const val = firstKey ? String(row[firstKey] ?? '') : '';
          return val.trim() || `Row ${i + 1}`;
        };

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>

            {/* Existing rows */}
            {rows.map((row, i) => (
              <Card key={i} className="border">
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
                  onClick={() => toggleRow(i)}
                >
                  <span className="text-sm font-medium">{rowSummary(row, i)}</span>
                  <div className="flex items-center gap-1">
                    {!disabled && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={e => { e.stopPropagation(); setEditingIndex(i); setAddingNew(false); }}
                        >
                          <span className="text-xs">Edit</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={e => { e.stopPropagation(); deleteRow(i); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {expandedRows.has(i) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedRows.has(i) && editingIndex !== i && (
                  <CardContent className="pt-0 pb-3 px-3">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      {groupFields.map(gf => (
                        <div key={gf.id}>
                          <dt className="text-xs text-muted-foreground">{gf.label}</dt>
                          <dd>{String(row[gf.id] ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                )}

                {editingIndex === i && (
                  <CardContent className="pt-0 pb-3 px-3">
                    <RowEditor
                      groupFields={groupFields}
                      initial={row}
                      onSave={data => saveRow(i, data)}
                      onCancel={() => setEditingIndex(null)}
                    />
                  </CardContent>
                )}
              </Card>
            ))}

            {/* Add new row */}
            {addingNew && (
              <RowEditor
                groupFields={groupFields}
                initial={{}}
                onSave={addRow}
                onCancel={() => setAddingNew(false)}
              />
            )}

            {!disabled && !addingNew && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setAddingNew(true); setEditingIndex(null); }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add {field.label} row
              </Button>
            )}

            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
          </div>
        );
      }}
    />
  );
}
