import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPanel from './SettingsPanel';
import type { ModelConfig } from '../../types';

type FetchCall = [string, RequestInit?];
type FetchOptions = RequestInit & { body?: string };

const mockModels: ModelConfig[] = [
  { id: 'GEMINI', name: 'gemini-3.1-pro-preview', provider: 'GEMINI', apiStyle: 'GEMINI', modelName: 'gemini-3.1-pro-preview', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent', isCustom: false, isSimulated: false, avatarColor: '#00f3ff', description: 'Google Gemini 3.1 Pro Preview' },
  { id: 'OPENAI', name: 'GPT-5.4', provider: 'OPENAI', apiStyle: 'OPENAI', modelName: 'gpt-5.4', endpoint: 'https://api.openai.com/v1/chat/completions', isCustom: false, isSimulated: false, avatarColor: '#10a37f', description: 'OpenAI GPT-5.4' },
  { id: 'ANTHROPIC', name: 'claude-sonnet-4.6', provider: 'ANTHROPIC', apiStyle: 'ANTHROPIC', modelName: 'claude-sonnet-4.6', endpoint: 'https://api.anthropic.com/v1/messages', isCustom: false, isSimulated: false, avatarColor: '#d97757', description: 'Anthropic Sonnet 4.6' },
  { id: 'ZAI', name: 'glm-5.1', provider: 'ZAI', apiStyle: 'OPENAI', modelName: 'glm-5.1', endpoint: 'https://api.z.ai/api/coding/paas/v4', isCustom: true, isSimulated: false, avatarColor: '#fff', description: 'Z.AI GLM 5.1' },
];

describe('SettingsPanel', () => {
  const mockDispatch = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request, options?: RequestInit) => {
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
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.reject(new Error('Not mocked'));
    }));

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders seeded default models', async () => {
    render(<SettingsPanel dispatch={mockDispatch} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.queryByText('LOADING NEURAL PATHWAYS...')).not.toBeInTheDocument();
    });

    // Verify each model name is rendered (some appear in both name and modelName inputs)
    const allInputs = screen.getAllByDisplayValue(/gemini-3\.1-pro-preview|GPT-5\.4|claude-sonnet-4\.6|glm-5\.1/);
    expect(allInputs.length).toBeGreaterThanOrEqual(4);

    // Verify at least one input for each expected value exists
    expect(screen.getAllByDisplayValue('gemini-3.1-pro-preview').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('GPT-5.4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('claude-sonnet-4.6').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('glm-5.1').length).toBeGreaterThanOrEqual(1);

    const endpoints = screen.getAllByPlaceholderText('https://api...');
    expect(endpoints).toHaveLength(4);
    expect((endpoints[0] as HTMLInputElement).value).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent');

    const modelNames = screen.getAllByPlaceholderText('model-name');
    expect(modelNames).toHaveLength(4);
    expect((modelNames[0] as HTMLInputElement).value).toBe('gemini-3.1-pro-preview');
  });

  it('updates the visible model label when model id input changes', async () => {
    render(<SettingsPanel dispatch={mockDispatch} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.queryByText('LOADING NEURAL PATHWAYS...')).not.toBeInTheDocument();
    });

    const modelNames = screen.getAllByPlaceholderText('model-name');
    fireEvent.change(modelNames[0], { target: { value: 'gemini-4-flash' } });

    const updatedNameInputs = screen.getAllByDisplayValue('gemini-4-flash');
    expect(updatedNameInputs.length).toBeGreaterThan(0);
    expect(updatedNameInputs[0]).toHaveValue('gemini-4-flash');
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
