import { Navigate, useParams, type RouteObject } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AboutPage } from './pages/AboutPage'
import { DashboardPage } from './pages/DashboardPage'
import { HomePage } from './pages/HomePage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { UploadPage } from './pages/UploadPage'
import { isDatasetKey, useSession } from './state/session'

/** A sample person's score, or the visitor's own once they have brought a file. */
function ScoreRoute() {
  const { person = '' } = useParams()
  const { upload } = useSession()

  if (!isDatasetKey(person)) return <NotFoundPage />
  if (person === 'mine' && !upload) return <Navigate to="/upload" replace />
  return <DashboardPage />
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'score/:person', element: <ScoreRoute /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'how-it-works', element: <HowItWorksPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
