import { useState, useCallback } from 'react';

// Global active region — stored in localStorage
// null = "All Regions" (C-Level default)
// UUID = specific region

export function useActiveRegion(): [string | null, (id: string | null) => void] {
  const [regionId, setRegionId] = useState<string | null>(() => {
    return localStorage.getItem('active_region') || null;
  });

  const setActiveRegion = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem('active_region', id);
    } else {
      localStorage.removeItem('active_region');
    }
    setRegionId(id);
    // Reload to apply filter everywhere
    window.location.reload();
  }, []);

  return [regionId, setActiveRegion];
}
