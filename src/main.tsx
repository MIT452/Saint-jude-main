import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AuthPage from './components/AuthPage.tsx'
import './styles/globals.css'
import { store } from './redux'
import { Provider, useSelector } from 'react-redux'
import { RootState } from './redux'

function Root() {
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  return currentUser ? <App /> : <AuthPage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <Root />
    </Provider>
  </React.StrictMode>,
)