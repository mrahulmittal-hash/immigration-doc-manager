import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessRoute } from '../constants/roles';

export default function ProtectedRoute({ children, roles, path }) {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" />;

    if (roles && !roles.includes(user.role)) {
        return <Navigate to="/" />;
    }

    if (path && !canAccessRoute(user.role, path)) {
        return <Navigate to="/" />;
    }

    return children;
}
