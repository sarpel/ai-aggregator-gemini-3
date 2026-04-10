import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPanel from './SettingsPanel';
import type { ModelConfig } from '../../types';

type FetchCall = [string, RequestInit?];
type FetchOptions = RequestInit & { body?: string };

const mockModels: ModelConfig[] = [
  { id: '1', name: 'Model 1', provider: 'OPENAI', apiStyle: 'OPENAI', modelName: 'gpt-4', endpoint: 'https://api.openai.com', isCustom: false, isSimulated: false, avatarColor: '#fff', description: '' },
  { id: '2', name: 'Model 2', provider: 'ANTHROPIC', apiStyle: 'ANTHROPIC', modelName: 'claude-3', endpoint: 'https://api.anthropic.com', isCustom: false, isSimulated: false, avatarColor: '#fff', description: '' },
  { id: '3', name: 'Model 3', provider: 'GEMINI', apiStyle: 'GEMINI', modelName: 'gemini-pro', endpoint: 'https://generativelanguage.googleapis.com', isCustom: false, isSimulated: false, avatarColor: '#fff', description: '' },
  { id: '4', name: 'Model 4', provider: 'OPENAI', apiStyle: 'OPENAI', modelName: 'gpt-3.5', endpoint: 'https://api.openai.com', isCustom: false, isSimulated: false, avatarColor: '#fff', description: '' },
  { id: '5', name: 'Model 5', provider: 'ANTHROPIC', apiStyle: 'ANTHROPIC', modelName: 'claude-2', endpoint: 'https://api.anthropic.com', isCustom: false, isSimulated: false, avatarColor: '#fff', description: '' },
];

describe('SettingsPanel', () => {
  const mockDispatch = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request, options?: RequestInit) => {
      const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      const requestOptions = options as FetchOptions | undefined;

      if (requestUrl === '/api/models' && (!requestOptions || requestOptions.method === 'GET' || !requestOptions.method)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels)
        });
      }
      if (requestUrl === '/api/models' && requestOptions?.method === 'POST') {
        const body = JSON.parse(requestOptions.body ?? '{}') as Record<string, string>;

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(normalizeCreatedModel(body)),
        });
      }
      if (requestUrl.match(/\/api\/models\/.*\/key\/status/)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasKey: false })
        });
      }
      if (requestOptions && requestOptions.method === 'PUT') {
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error('Not mocked'));
    });
    
    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: () => 'test-uuid-1234'
      }
    });
  });

  it('renders seeded default models', async () => {
    render(<SettingsPanel dispatch={mockDispatch} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.queryByText('LOADING NEURAL PATHWAYS...')).not.toBeInTheDocument();
    });

    const nameInputs = screen.getAllByDisplayValue(/Model \d/);
    expect(nameInputs).toHaveLength(5);
    expect(nameInputs[0]).toHaveValue('Model 1');
    expect(nameInputs[1]).toHaveValue('Model 2');
    expect(nameInputs[2]).toHaveValue('Model 3');
    expect(nameInputs[3]).toHaveValue('Model 4');
    expect(nameInputs[4]).toHaveValue('Model 5');

    const endpoints = screen.getAllByPlaceholderText('https://api...');
    expect(endpoints).toHaveLength(5);
    expect((endpoints[0] as HTMLInputElement).value).toBe('https://api.openai.com');

    const modelNames = screen.getAllByPlaceholderText('model-name');
    expect(modelNames).toHaveLength(5);
    expect((modelNames[0] as HTMLInputElement).value).toBe('gpt-4');
  });

  it('updates the visible model label when model id input changes', async () => {
    render(<SettingsPanel dispatch={mockDispatch} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.queryByText('LOADING NEURAL PATHWAYS...')).not.toBeInTheDocument();
    });

    const modelNames = screen.getAllByPlaceholderText('model-name');
    fireEvent.change(modelNames[0], { target: { value: 'gpt-4.1-mini' } });

    const updatedNameInputs = screen.getAllByDisplayValue('gpt-4.1-mini');
    expect(updatedNameInputs.length).toBeGreaterThan(0);
    expect(updatedNameInputs[0]).toHaveValue('gpt-4.1-mini');
  });

  it('adds custom model and saves correctly', async () => {
    render(<SettingsPanel dispatch={mockDispatch} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.queryByText('LOADING NEURAL PATHWAYS...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByText('ADD CUSTOM MODEL');
    fireEvent.click(addButton);

    // Should add a new model card
    const newModelInputs = screen.getAllByDisplayValue('New Custom Model');
    expect(newModelInputs.length).toBeGreaterThan(0);

    // Fill in the new model details
    const endpoints = screen.getAllByPlaceholderText('https://api...');
    const newEndpoint = endpoints[endpoints.length - 1];
    fireEvent.change(newEndpoint, { target: { value: 'https://custom.api' } });

    const modelNames = screen.getAllByPlaceholderText('model-name');
    const newModelName = modelNames[modelNames.length - 1];
    fireEvent.change(newModelName, { target: { value: 'custom-model-1' } });

    const apiKeys = screen.getAllByPlaceholderText('Enter API Key');
    const newApiKey = apiKeys[apiKeys.length - 1];
    fireEvent.change(newApiKey, { target: { value: 'secret-key' } });

    const saveButton = screen.getByText('SAVE CONFIGURATION');
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Check if POST /api/models was called
      const fetchCalls = vi.mocked(global.fetch).mock.calls as FetchCall[];
      const postModelCall = fetchCalls.find((call) => 
        call[0] === '/api/models' && call[1]?.method === 'POST'
      );
      expect(postModelCall).toBeTruthy();
      
      const body = JSON.parse((postModelCall?.[1] as FetchOptions | undefined)?.body ?? '{}');
      expect(body.endpoint).toBe('https://custom.api');
      expect(body.modelName).toBe('custom-model-1');
      expect(body.apiKey).toBe('secret-key');

      const keyRouteCall = fetchCalls.find((call) => 
        typeof call[0] === 'string' && call[0].includes('/key') && call[1]?.method === 'POST'
      );
      expect(keyRouteCall).toBeFalsy();

      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SET_MODEL_CONFIGS'
      }));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

function normalizeCreatedModel(body: Record<string, string>): ModelConfig {
  return {
    id: 'generated-server-id',
    name: body.name ?? 'Created Model',
    provider: 'CUSTOM',
    apiStyle: (body.apiStyle as ModelConfig['apiStyle']) ?? 'OPENAI',
    modelName: body.modelName ?? '',
    endpoint: body.endpoint ?? '',
    isCustom: true,
    isSimulated: false,
    avatarColor: body.avatarColor ?? '#00f3ff',
    description: body.description ?? '',
  };
}
