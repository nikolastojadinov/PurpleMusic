import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";

import "./index.css";
import ArtistPage from "./pages/Artist";
import HomePage from "./pages/Home";
import PlaylistPage from "./pages/Playlist";
import SearchPage from "./pages/Search";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/search", label: "Search" },
  { to: "/artist", label: "Artist" },
  { to: "/playlist", label: "Playlist" },
];

function Navigation() {
  return (
    <nav className="top-nav">
      <div className="nav-rail">
        <div className="brand-mark" aria-label="PurpleMusic UI">
          <span className="dot" aria-hidden />
          <span className="brand-title">PurpleMusic</span>
        </div>
        <div className="nav-links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-wrapper">
        <Navigation />
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/artist">
              <Route index element={<ArtistPage />} />
              <Route path=":artistId" element={<ArtistPage />} />
            </Route>
            <Route path="/playlist">
              <Route index element={<PlaylistPage />} />
              <Route path=":playlistId" element={<PlaylistPage />} />
            </Route>
            <Route path="*" element={<HomePage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
