import { useMemo } from 'react';

// This helper calculates stats for ANY list of residents passed to it
export const useAnalyticsMath = (data: any[]) => {
  return useMemo(() => {
    const total = data.length;
    if (total === 0) return null;

    let senior = 0, adult = 0, minor = 0;
    let male = 0, female = 0;
    let employed = 0;

    data.forEach((r: any) => {
      // Age
      const age = Number(r.age || 0);
      if (age >= 60) senior++;
      else if (age < 18) minor++;
      else adult++;

      // Gender
      const sex = (r.sex || r.gender || '').toLowerCase();
      if (sex.startsWith('m')) male++;
      else if (sex.startsWith('f')) female++;

      // Employment
      const occ = (r.occupation || '').toLowerCase();
      if (occ && !['none', 'n/a', 'unemployed', 'student'].includes(occ)) {
        employed++;
      }
    });

    return {
      total,
      gender: {
        male,
        female,
        malePct: Math.round((male / total) * 100),
        femalePct: Math.round((female / total) * 100),
      },
      age: {
        senior,
        adult,
        minor,
        seniorPct: Math.round((senior / total) * 100),
        adultPct: Math.round((adult / total) * 100),
        minorPct: Math.round((minor / total) * 100),
      },
      employment: {
        count: employed,
        pct: Math.round((employed / total) * 100)
      }
    };
  }, [data]);
};