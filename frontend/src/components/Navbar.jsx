function Navbar() {
  return (
    <nav className="navbar">
      <a href="/" className="logo">
        <span className="logo-icon">▶</span>
        TRACK MY TRACKS
      </a>

      <div className="nav-links">
        <a href="/" className="active">
          Home
        </a>

        <a href="#">Discover</a>
        <a href="#">Reviews</a>
        <a href="#">Playlists</a>
      </div>

      <div className="nav-actions">
        <a href="#" className="login-link">
          Log In
        </a>

        <a href="#" className="signup-btn">
          Sign Up
        </a>
      </div>
    </nav>
  );
}

export default Navbar;