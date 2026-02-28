import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserService } from '@/services/users';
import type { User } from '@/types/organization';

interface ConsultantPickerProps {
  orgId: string;
  value: string;           // selected member uid
  onSelect: (uid: string, email: string, displayName: string) => void;
}

export function ConsultantPicker({ orgId, value, onSelect }: ConsultantPickerProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    UserService.getByOrganization(orgId)
      .then(users =>
        setMembers(
          users
            .filter(u => (u.role === 'MEMBER' || u.role === 'ORG_ADMIN') && u.status === 'ACTIVE')
            .sort((a, b) => {
              // Admins first, then members alphabetically
              if (a.role === 'ORG_ADMIN' && b.role !== 'ORG_ADMIN') return -1;
              if (a.role !== 'ORG_ADMIN' && b.role === 'ORG_ADMIN') return 1;
              return (a.displayName || a.email).localeCompare(b.displayName || b.email);
            })
        )
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  const selected = members.find(m => m.uid === value);
  const displayLabel = selected
    ? (selected.displayName || selected.email)
    : 'Select a team member…';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayLabel}</span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search team members…" />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading…' : 'No active members found in this organization.'}
            </CommandEmpty>
            <CommandGroup>
              {members.map(member => (
                <CommandItem
                  key={member.uid}
                  value={`${member.displayName || ''} ${member.email}`}
                  onSelect={() => {
                    onSelect(member.uid, member.email, member.displayName || member.email);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4 shrink-0', value === member.uid ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {member.displayName || member.email}
                      </span>
                      <Badge
                        variant={member.role === 'ORG_ADMIN' ? 'default' : 'secondary'}
                        className="text-xs shrink-0 px-1.5 py-0"
                      >
                        {member.role === 'ORG_ADMIN' ? 'Admin' : 'Member'}
                      </Badge>
                    </div>
                    {member.displayName && (
                      <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
