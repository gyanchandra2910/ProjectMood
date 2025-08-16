import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ProjectMood heading', () => {
  render(<App />);
  const linkElement = screen.getByText(/ProjectMood/i);
  expect(linkElement).toBeInTheDocument();
});
