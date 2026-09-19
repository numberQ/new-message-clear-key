// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import manifest from 'manifest';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import type {PluginRegistry} from 'types/mattermost-webapp';

const PREF_SHORTCUT_ENABLED = 'shortcut_enabled';
const PREF_SHORTCUT_KEY = 'shortcut_key';

const DEFAULT_SHORTCUT = 'Escape';

/**
 * The post list sets the New Message separator location based on
 * the last viewed time for the channel. Typically, this is only set
 * when loading into a channel. So all we have to do is make that time
 * the current time stamp by dispatching a new member state.
 *
 * @return true if we succeeded, false otherwise
 */
function clearNewMessageSeparator(store: Store<GlobalState>): boolean {
    const state = store.getState();

    const channelId = state.entities.channels.currentChannelId;
    if (!channelId) {
        return false;
    }

    const channel = state.entities.channels.channels[channelId];
    const member = state.entities.channels.myMembers[channelId];
    if (!channel || !member) {
        return false;
    }

    store.dispatch({
        type: "SELECT_CHANNEL_WITH_MEMBER",
        data: channelId,
        channel,
        member: {...member, last_viewed_at: Date.now()},
    });

    // This unhighlights the channel in the sidebar,
    // if the user manually marked a post as unread.
    if (state.entities.channels.manuallyUnread[channelId]) {
        store.dispatch({
            type: "REMOVE_MANUALLY_UNREAD",
            data: {channelId},
        });
    }

    return true;
}

function handleKeyDown(e: KeyboardEvent, store: Store<GlobalState>) {
    // Don't fire if the user is holding down the key
    if (e.repeat) {
        return;
    }

    // TODO: return if we're in a typing target, maybe

    const state = store.getState();

    // We wait until now to check if it's even enabled, so less expensive checks come first.
    if (!isShortcutEnabled(state)) {
        return;
    }

    // TODO: return if shortcut modal is open

    // We want to read the preference every time instead of just once on init.
    // This is to ensure rebinds take effect immediately, including across tabs.
    // TODO: don't hardcode this as Escape
    if (e.key !== 'Escape') {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    clearNewMessageSeparator(store);
}

function getPreference(state: GlobalState, name: string, defaultValue = ''): string {
    return state.entities.preferences.myPreferences[`pp_${manifest.id}--${name}`]?.value ?? defaultValue;
}

function isShortcutEnabled(state: GlobalState): boolean {
    return getPreference(state, PREF_SHORTCUT_ENABLED, 'true') !== 'false';
}

export default class Plugin {

    private onKeyDown?: (e: KeyboardEvent) => void;

    public initialize(registry: PluginRegistry, store: Store<GlobalState>) {
        this.registerSettings(registry, store);

        this.onKeyDown = (e: KeyboardEvent) => handleKeyDown(e, store);
        window.addEventListener('keydown', this.onKeyDown, {capture: true});
    }

    public uninitialize() {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, {capture: true});
            this.onKeyDown = undefined;
        }
    }

    private registerSettings(registry: PluginRegistry, store: Store<GlobalState>) {
        const state = store.getState();

        registry.registerUserSettings({
            id: manifest.id,
            uiName: manifest.name,
            action: {
                title: 'Keyboard Shortcut',
                text: `Currently: ${'test'}`,
                buttonText: 'Set Shortcut',
                onClick: () => {},
            },
            sections: [
                {
                    title: 'Enable Shortcut',
                    settings: [
                        {
                            name: PREF_SHORTCUT_ENABLED,
                            title: 'Enable pressing your configured shortcut to clear New Messages?',
                            type: 'radio',
                            default: 'true',
                            options: [
                                {value: 'true', text: 'On'},
                                {value: 'false', text: 'Off'},
                            ],
                        },
                    ],
                },
            ],
        });
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());
