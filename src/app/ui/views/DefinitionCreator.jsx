import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Radio } from '../components/Radio';
import Select from '../components/Select';
import { TextInput as Input } from '../components/Input';

import i18n from '../../lib/i18n';

class DefinitionCreator extends PureComponent {
    static propTypes = {
        isCreate: PropTypes.bool,
        disableCategory: PropTypes.bool,
        copyType: PropTypes.string,
        copyCategoryName: PropTypes.string,
        copyToolName: PropTypes.string,
        materialOptions: PropTypes.array
    };

    static defaultProps = {
        disableCategory: true
    };

    state = {
        createType: 'Material',
        materialName: 'Default Material',
        toolName: 'Default Tool'
    }

    componentDidMount() {
        if (this.props.copyCategoryName) {
            this.setState({
                materialName: this.props.copyCategoryName
            });
        }
        if (this.props.copyToolName) {
            this.setState({
                toolName: this.props.copyToolName
            });
        }
    }

    getData() {
        return this.state;
    }

    renderMaterialCreate() {
        return (
            <div>
                <span className="font-size-base display-block margin-vertical-8">{i18n._('Enter material name')}</span>
                <Input
                    size="432px"
                    onChange={(event) => {
                        const materialName = event.target.value;
                        this.setState({ materialName });
                    }}
                    value={this.state.materialName}
                />
            </div>
        );
    }

    renderToolCreate() {
        return (
            <div>
                {this.props.disableCategory && (
                    <div>
                        <span className="font-size-base display-block margin-vertical-8">{i18n._('Enter Profile Name')}</span>
                        <Input
                            size="432px"
                            onChange={(event) => {
                                const toolName = event.target.value;
                                this.setState({ toolName });
                            }}
                            value={this.state.toolName}
                        />
                    </div>
                )}
                {!this.props.disableCategory && (
                    <div>
                        <span className="font-size-base display-block margin-vertical-8">{i18n._('Enter tool name')}</span>
                        <Input
                            size="432px"
                            onChange={(event) => {
                                const toolName = event.target.value;
                                this.setState({ toolName });
                            }}
                            value={this.state.toolName}
                        />
                        <p className="margin-top-16 font-size-base">
                            {i18n._('Select material type')}
                        </p>
                        <Select
                            size="432px"
                            backspaceRemoves={false}
                            clearable={false}
                            options={this.props.materialOptions}
                            placeholder={i18n._('Choose font')}
                            value={this.state.materialName}
                            onChange={(option) => {
                                const materialName = option.label;
                                this.setState({ materialName });
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }


    render() {
        const { isCreate } = this.props;
        if (isCreate) {
            return (
                <Radio.Group
                    name="comic"
                    value={this.state.createType}
                    onChange={(event) => {
                        const value = event.target.value;
                        this.setState({ createType: value });
                    }}
                >
                    <div>
                        <Radio value="Material" className="height-24">{i18n._('Create Material')}</Radio>
                        {this.state.createType === 'Material' && this.renderMaterialCreate()}
                    </div>

                    <div className="margin-top-16">
                        <Radio value="Tool" className="height-24">{i18n._('Create Carving Tool')}</Radio>
                        {this.state.createType === 'Tool' && this.renderToolCreate()}
                    </div>

                </Radio.Group>
            );
        } else {
            if (this.props.copyType === 'Material') {
                return this.renderMaterialCreate();
            } else {
                return this.renderToolCreate();
            }
        }
    }
}

export default DefinitionCreator;
