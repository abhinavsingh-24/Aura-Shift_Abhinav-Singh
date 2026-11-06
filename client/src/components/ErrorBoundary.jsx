import React, { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SIDEQUEST Unhandled UI Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container" role="alert">
          <div className="error-boundary-card">
            <div className="error-emblem">🧭</div>
            <h2>The compass lost its bearing</h2>
            <p>
              An unexpected hiccup interrupted your expedition. Don’t worry, your tickets and saved quests are safe.
            </p>
            {this.state.error?.message && (
              <pre className="error-details">{this.state.error.message}</pre>
            )}
            <div className="error-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={this.handleReset}
              >
                Return to Safe Ground (Home)
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => window.location.reload()}
              >
                Reload Expedition
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

