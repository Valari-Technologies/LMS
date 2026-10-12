import { useOutletContext, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function usePermission() {
  const { user } = useAuth();
  const location = useLocation();
  const outletContext = useOutletContext() || {};

  const isReadOnlyRole = user?.role === 'readonly_admin' || user?.role === 'read_only_admin';
  
  let isReadOnly = isReadOnlyRole || Boolean(outletContext.isReadOnlyPage);

  if (!isReadOnly && user?.permissions) {
    try {
      const parsed = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      if (parsed && typeof parsed === 'object') {
        const path = location.pathname;
        const keys = Object.keys(parsed);
        const sortedKeys = keys.sort((a, b) => b.length - a.length);
        const matchedKey = sortedKeys.find(k => k !== '/admin' && path.startsWith(k)) || (parsed[path] ? path : null);
        
        const permVal = matchedKey ? parsed[matchedKey] : parsed[path];
        if (permVal === 'READ_ONLY' || (typeof permVal === 'object' && permVal?.mode === 'READ_ONLY')) {
          isReadOnly = true;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return { isReadOnly, user };
}

