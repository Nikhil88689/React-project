import {
  AVAILABILITY,
  AVAILABILITY_LABELS,
  STAGE_LABELS,
  STAGE_TYPES,
  type CandidateSummaryDTO,
  type CursorMeta,
} from '@recruitflow/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MapPin, Search, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MatchScore, StageBadge } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn, fullName, pluralize } from '@/lib/utils';

export function CandidatesPage() {
  useDocumentTitle('Candidates');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [skills, setSkills] = useState(params.get('skills') ?? '');
  const [location, setLocation] = useState(params.get('location') ?? '');
  const q = useDebounce(search.trim());
  const skillQ = useDebounce(skills.trim());
  const locQ = useDebounce(location.trim());
  const stage = params.get('stage') ?? '';
  const minMatch = params.get('minMatch') ?? '';
  const availability = params.get('availability') ?? '';
  const minExperience = params.get('minExperience') ?? '';

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const query = { search: q, skills: skillQ, location: locQ, stage, minMatch, availability, minExperience, limit: 24 };
  const list = useInfiniteQuery({
    queryKey: ['candidates', query],
    queryFn: ({ pageParam }) => api.getEnvelope<CandidateSummaryDTO[]>('/candidates', { ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta as CursorMeta | undefined)?.nextCursor ?? undefined,
  });

  const candidates = list.data?.pages.flatMap((p) => p.data) ?? [];
  const total = (list.data?.pages[0]?.meta as CursorMeta | undefined)?.total;
  const filtered = Boolean(q || skillQ || locQ || stage || minMatch || availability || minExperience);

  return (
    <>
      <PageHeader title="Candidates" description={total != null ? `${pluralize(total, 'candidate')} in your talent database.` : 'Search, filter and open profiles.'} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => (setSearch(e.target.value), setParam('search', e.target.value))} placeholder="Search name, email, skill…" className="pl-9" aria-label="Search candidates" />
        </div>
        <Input value={skills} onChange={(e) => (setSkills(e.target.value), setParam('skills', e.target.value))} placeholder="Skills (comma separated)" className="w-48" />
        <div className="relative w-40">
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={location} onChange={(e) => (setLocation(e.target.value), setParam('location', e.target.value))} placeholder="Location" className="pl-9" />
        </div>
        <NativeSelect value={stage} onChange={(e) => setParam('stage', e.target.value)} className="w-36" aria-label="Stage">
          <option value="">All stages</option>
          {STAGE_TYPES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={minMatch} onChange={(e) => setParam('minMatch', e.target.value)} className="w-36" aria-label="Match score">
          <option value="">Any match</option>
          <option value="80">80%+ match</option>
          <option value="70">70%+ match</option>
          <option value="50">50%+ match</option>
        </NativeSelect>
        <NativeSelect value={minExperience} onChange={(e) => setParam('minExperience', e.target.value)} className="w-36">
          <option value="">Any experience</option>
          <option value="2">2+ years</option>
          <option value="3">3+ years</option>
          <option value="5">5+ years</option>
        </NativeSelect>
        <NativeSelect value={availability} onChange={(e) => setParam('availability', e.target.value)} className="w-36">
          <option value="">Availability</option>
          {AVAILABILITY.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABELS[a]}
            </option>
          ))}
        </NativeSelect>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setSkills('');
              setLocation('');
              setParams({}, { replace: true });
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {list.isError ? (
        <Card>
          <ErrorState message="We couldn't load candidates." onRetry={() => list.refetch()} />
        </Card>
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={filtered ? 'No candidates match these filters' : 'No candidates yet'}
            description={filtered ? 'Try a broader search or clear the filters.' : 'Once candidates apply to your jobs, they’ll appear here.'}
            action={
              !filtered ? (
                <Button asChild>
                  <Link to="/jobs/new">Create job</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {candidates.map((c) => (
              <Link key={c.id} to={`/candidates/${c.id}`} className="block">
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <Avatar name={fullName(c)} src={c.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{fullName(c)}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.headline ?? c.latestApplication?.jobTitle ?? '—'}</p>
                    </div>
                    <MatchScore score={c.bestMatch} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {[c.experienceYears != null ? `${c.experienceYears} yrs` : null, c.currentCompany, c.location].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.skills.slice(0, 5).map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    {c.latestApplication ? <StageBadge type={c.latestApplication.stageType} name={c.latestApplication.stageName} /> : <span className="text-xs text-muted-foreground">Talent pool</span>}
                    {c.bestMatch != null && (
                      <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground')}>
                        <Sparkles className="size-3" /> AI match
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {list.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
