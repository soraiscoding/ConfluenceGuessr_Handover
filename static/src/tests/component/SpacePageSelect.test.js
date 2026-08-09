import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SpacePageSelect from '../../screens/SpacePageSelect';

jest.mock('../../components/componentThemes.js', () => ({
  ButtonThemes: { default_primary: 'default_primary' },
}));

const pages = [
  { id: 'p1', title: 'Onboarding', space: 'Engineering', restricted: false },
  { id: 'p2', title: 'Meeting Notes', space: 'Engineering', restricted: false },
  { id: 'p3', title: 'Secret Doc', space: 'Legal', restricted: true },
];

test('renders the title', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText('Choose spaces / pages')).toBeInTheDocument();
});

test('renders all page titles', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText('Onboarding')).toBeInTheDocument();
  expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  expect(screen.getByText('Secret Doc')).toBeInTheDocument();
});

test('shows lock badge on restricted pages', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText('🔒 No access')).toBeInTheDocument();
});

test('restricted page checkbox is disabled', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  const checkboxes = screen.getAllByRole('checkbox');
  const secretDocCheckbox = checkboxes.find((cb) => cb.closest('li')?.textContent.includes('Secret Doc'));
  expect(secretDocCheckbox).toBeDisabled();
});

test('confirm button is disabled when nothing is selected', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText(/Confirm/)).toBeDisabled();
});

test('confirm button enables after selecting a page', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  fireEvent.click(screen.getByLabelText(/Onboarding/));
  expect(screen.getByText(/Confirm \(1 selected\)/)).not.toBeDisabled();
});

test('calls onBack when Back is clicked', () => {
  const onBack = jest.fn();
  render(<SpacePageSelect pages={pages} onBack={onBack} onConfirm={() => {}} />);
  fireEvent.click(screen.getByText('Back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('calls onConfirm with selected ids when Confirm is clicked', () => {
  const onConfirm = jest.fn();
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText(/Onboarding/));
  fireEvent.click(screen.getByText(/Confirm/));
  const selectedArg = onConfirm.mock.calls[0][0];
  expect(selectedArg.has('p1')).toBe(true);
  expect(selectedArg.has('p2')).toBe(false);
});

test('select all selects all accessible pages', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  fireEvent.click(screen.getByLabelText(/Select all accessible/));
  expect(screen.getByText(/Confirm \(2 selected\)/)).not.toBeDisabled();
});

test('clicking select all again deselects all', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  fireEvent.click(screen.getByLabelText(/Select all accessible/));
  fireEvent.click(screen.getByLabelText(/Select all accessible/));
  expect(screen.getByText(/Confirm \(0 selected\)/)).toBeDisabled();
});

test('clicking a page again deselects it', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  fireEvent.click(screen.getByLabelText(/Onboarding/));
  fireEvent.click(screen.getByLabelText(/Onboarding/));
  expect(screen.getByText(/Confirm \(0 selected\)/)).toBeDisabled();
});

test('renders with no pages without crashing', () => {
  render(<SpacePageSelect pages={[]} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText('Choose spaces / pages')).toBeInTheDocument();
});

test('renders with no pages prop without crashing', () => {
  render(<SpacePageSelect onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByText('Choose spaces / pages')).toBeInTheDocument();
});

test('clicking space checkbox selects all pages in that space', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  const spaceCheckbox = screen.getByLabelText(/Engineering/);
  fireEvent.click(spaceCheckbox);
  expect(screen.getByText(/Confirm \(2 selected\)/)).not.toBeDisabled();
});

test('clicking space checkbox again deselects all pages in that space', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  const spaceCheckbox = screen.getByLabelText(/Engineering/);
  fireEvent.click(spaceCheckbox);
  fireEvent.click(spaceCheckbox);
  expect(screen.getByText(/Confirm \(0 selected\)/)).toBeDisabled();
});

test('space with only restricted pages has disabled space checkbox', () => {
  render(<SpacePageSelect pages={pages} onBack={() => {}} onConfirm={() => {}} />);
  expect(screen.getByLabelText(/Legal/)).toBeDisabled();
});
