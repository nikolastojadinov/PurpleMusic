import { useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import "./index.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import FullscreenPlayer from "./components/player/FullscreenPlayer";
import MiniPlayer from "./components/player/MiniPlayer";
import AlbumPage from "./pages/AlbumPage";
import ArtistPage from "./pages/Artist";
import HomePage from "./pages/Home";
import PlaylistPage from "./pages/Playlist";
import SearchPage from "./pages/Search";

const MOCK_TRACK = {
  title: "Velvet Skyline",
  artist: "Aya Loren",
  cover: "https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=640&q=80",
  durationSeconds: 212,
};

function Shell() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(26); // percent
  const [volume, setVolume] = useState(70);

  const durationSeconds = MOCK_TRACK.durationSeconds;
  const currentSeconds = useMemo(() => Math.round((progress / 100) * durationSeconds), [progress, durationSeconds]);

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const scrub = (next: number) => setProgress(Math.min(100, Math.max(0, next)));
  const changeVolume = (next: number) => setVolume(Math.min(100, Math.max(0, next)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-20 md:px-6 md:pt-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/artist/:artistId" element={<ArtistPage />} />
          <Route path="/artist" element={<ArtistPage />} />
          <Route path="/playlist/:playlistId" element={<PlaylistPage />} />
          <Route path="/playlist" element={<PlaylistPage />} />
          <Route path="/album/:albumId" element={<AlbumPage />} />
          <Route path="/album" element={<AlbumPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      <MiniPlayer
        title={MOCK_TRACK.title}
        artist={MOCK_TRACK.artist}
        cover={MOCK_TRACK.cover}
        isPlaying={isPlaying}
        isFullscreen={isFullscreen}
        progress={progress}
        onTogglePlay={togglePlay}
        onOpen={() => setIsFullscreen(true)}
      />

      <FullscreenPlayer
        title={MOCK_TRACK.title}
        artist={MOCK_TRACK.artist}
        cover={MOCK_TRACK.cover}
        isOpen={isFullscreen}
        isPlaying={isPlaying}
        progress={progress}
        durationSeconds={durationSeconds}
        volume={volume}
        onTogglePlay={togglePlay}
        onClose={() => setIsFullscreen(false)}
        onScrub={scrub}
        onVolume={changeVolume}
        currentSeconds={currentSeconds}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
