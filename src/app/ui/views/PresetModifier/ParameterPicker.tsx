import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { includes, throttle } from 'lodash';

import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';

import styles from './styles.styl';
import SvgIcon from '../../components/SvgIcon';
import CheckboxItem from '../ProfileManager/CheckboxItem';

type Props = {
    definitionManager: any;
    customConfigs: any;
    optionConfigGroup: any;
    definitionForManager: any;
    onChangeCustomConfig: any;
};

/**
 * Parameter Picker.
 *
 * Pick parameters to be shown.
 *
 * This component will take 100% width and height of its parent.
 *
 * @constructor
 */
const ParameterPicker: React.FC<Props> = (props) => {
    const {
        definitionManager,
        definitionForManager,
        customConfigs,
        optionConfigGroup,
        onChangeCustomConfig,
    } = props;

    const [activeCateId, setActiveCateId] = useState(2);

    const scrollDom = useRef(null);
    const fieldsDom = useRef([]);
    const [tempDoms, setTempdoms] = useState([]);


    function setActiveCate(cateId?: number) {
        if (scrollDom.current) {
            const container = scrollDom.current.parentElement;
            const offsetTops = [...scrollDom.current.children].map(
                (i) => i.offsetTop
            );
            if (cateId !== undefined) {
                container.scrollTop = offsetTops[cateId];
            } else {
                cateId = offsetTops.findIndex((item, idx) => {
                    if (idx < offsetTops.length - 1) {
                        return item < container.scrollTop
                            && offsetTops[idx + 1] > container.scrollTop;
                    } else {
                        return item < container.scrollTop;
                    }
                });
                cateId = Math.max(cateId, 0);
            }
            setActiveCateId(cateId);
        }
    }

    const renderCheckboxList = (
        {
            renderList,
            settings,
            onChangeCustomConfig: _onChangeCustomConfig,
            categoryKey,
        }
    ) => {
        return renderList && renderList.map(profileKey => {
            if (definitionManager.qualityProfileArr && !(definitionManager.qualityProfileArr.includes(profileKey))) {
                return null;
            }
            if (settings[profileKey].childKey?.length > 0) {
                return (
                    <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex - 1) * 16}`}>
                        <CheckboxItem
                            settings={settings}
                            defaultValue={includes(
                                customConfigs ? customConfigs[categoryKey] : [],
                                profileKey
                            )}
                            definitionKey={profileKey}
                            key={profileKey}
                            onChangePresetSettings={_onChangeCustomConfig}
                            configCategory={categoryKey}
                        />
                        {renderCheckboxList({
                            // customConfigs: _customConfigs,
                            renderList: settings[profileKey].childKey,
                            settings,
                            onChangeCustomConfig: _onChangeCustomConfig,
                            categoryKey
                        })}
                    </div>
                );
            }
            return (
                <div key={profileKey} className={`margin-left-${(settings[profileKey].zIndex < 3 ? settings[profileKey].zIndex - 1 : 1) * 16}`}>
                    <CheckboxItem
                        settings={settings}
                        defaultValue={includes(
                            customConfigs ? customConfigs[categoryKey] : [],
                            profileKey
                        )}
                        definitionKey={
                            profileKey
                        }
                        key={profileKey}
                        onChangePresetSettings={_onChangeCustomConfig}
                        configCategory={categoryKey}
                    />
                </div>
            );
        });
    };

    useEffect(() => {
        setTempdoms(fieldsDom.current);
    }, []);

    console.log('qualityProfileArr =', definitionManager.qualityProfileArr);

    return (
        <div className="sm-flex width-percent-100 height-percent-100">
            <div
                className={classNames(
                    styles['manager-grouplist'],
                    // 'border-default-grey-1',
                    'padding-vertical-16',
                    // 'border-radius-8'
                )}
            >
                <div className="sm-parameter-container">
                    {Object.keys(optionConfigGroup).map((key, index) => {
                        return (
                            <div key={key}>
                                <Anchor
                                    className={classNames(styles.item, {
                                        [styles.selected]:
                                        index === activeCateId
                                    })}
                                    onClick={() => {
                                        setActiveCate(index);
                                    }}
                                >
                                    <span className="sm-parameter-header__title">{i18n._(`key-Definition/Catagory-${key}`)}</span>
                                </Anchor>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className={classNames(
                styles['manager-detail-and-docs'],
                'sm-flex',
                'justify-space-between'
            )}
            >
                <div
                    className={classNames(
                        styles['manager-details'],
                        // 'border-default-grey-1',
                        'border-radius-8',
                        'width-percent-60 '
                    )}
                    onWheel={throttle(
                        () => {
                            setActiveCate();
                        },
                        200,
                        { leading: false, trailing: true }
                    )}
                >
                    <div className="sm-parameter-container" ref={scrollDom}>
                        {
                            Object.keys(optionConfigGroup).map((key, index) => {
                                return (
                                    <div key={key}>
                                        {key && (tempDoms[index]?.clientHeight > 0) && (
                                            <div className="border-bottom-normal padding-bottom-8 margin-vertical-16">
                                                <SvgIcon
                                                    name="TitleSetting"
                                                    type={['static']}
                                                />
                                                <span className="margin-left-2">
                                                    {i18n._(`key-Definition/Catagory-${key}`)}
                                                </span>
                                            </div>
                                        )}
                                        {/* eslint no-return-assign: 0*/}
                                        <div>
                                            <div ref={(el) => (fieldsDom.current[index] = el)}>
                                                {renderCheckboxList({
                                                    customConfig: customConfigs,
                                                    renderList: optionConfigGroup[key],
                                                    settings: definitionForManager?.settings,
                                                    onChangeCustomConfig,
                                                    categoryKey: key
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParameterPicker;
