import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageClasses from './pages/admin/ManageClasses';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import LiveSession from './pages/teacher/LiveSession';
import ClassroomAttendance from './pages/teacher/ClassroomAttendance';
import AnalyticsReports from './pages/teacher/AnalyticsReports';
import StudentDashboard from './pages/student/StudentDashboard';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/student" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><ManageUsers /></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute roles={['ADMIN']}><ManageClasses /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute roles={['ADMIN']}><ClassroomAttendance /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['ADMIN']}><AnalyticsReports /></ProtectedRoute>} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<ProtectedRoute roles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/live" element={<ProtectedRoute roles={['TEACHER']}><LiveSession /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute roles={['TEACHER']}><ClassroomAttendance /></ProtectedRoute>} />
          <Route path="/teacher/reports" element={<ProtectedRoute roles={['TEACHER']}><AnalyticsReports /></ProtectedRoute>} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
