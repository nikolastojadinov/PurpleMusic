import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import FullscreenPlayer from "./components/player/FullscreenPlayer";
import MiniPlayer from "./components/player/MiniPlayer";
import YouTubePlayerContainer from "./components/player/YouTubePlayerContainer";
import AlbumPage from "./pages/AlbumPage";
import ArtistPage from "./pages/Artist";
import HomePage from "./pages/Home";
import PlaylistPage from "./pages/Playlist";
import SearchPage from "./pages/Search";
import { PlayerProvider } from "./lib/playerContext";

function Shell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="min-h-screen w-full px-0 pb-28 pt-20 md:pt-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/artist/:artistId" element={<ArtistPage />} />
          <Route path="/artist" element={<ArtistPage />} />
          <Route path="/playlist/:playlistId" element={<PlaylistPage />} />
          <Route path="/playlist" element={<PlaylistPage />} />
          <Route path="/album/:albumId" element={<AlbumPage />} />
          <Route path="/album" element={<AlbumPage />} />
          <Route path="/create" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      <MiniPlayer />
      <FullscreenPlayer />
      <YouTubePlayerContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </BrowserRouter>
  );
}
