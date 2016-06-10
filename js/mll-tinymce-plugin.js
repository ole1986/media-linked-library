(function($) {
    var that = null;
    var context = null;
    tinymce.create('tinymce.plugins.mll_plugin', {
        init: function(editor, url) {
            that = this;
            that.editor = editor;
            that.lastResult = [];
            that.curDir = null;
            
            editor.addButton('mll_button', {
                title: "Media Linked Library", // Tool tip
                image: MLL_PLUGIN_URL + 'img/' + MLL_TOOLBAR_BUTTON, // Image button
                cmd: 'mll_command' // command
            });

            editor.addCommand('mll_command', function() {
                var ts = new Date().getTime();
                editor.windowManager.open(
                    {
                        title: "Media Linked Library v" + MLL_VERSION,   //    The title of the dialog window.
                        file:  url + '/mll-tinymce-dialog.html?' + ts,      //    The HTML file with the dialog contents.
                        width: 900,                               //    The width of the dialog
                        height: 550,                              //    The height of the dialog
                        inline: 1                                 //    Whether to use modal dialog instead of separate browser window.
                    }
                );
            });
      
            editor.on('DblClick', function(f) {
                if (f.target.nodeName == "IMG" && that.editor.dom.hasClass(f.target, "media_reference")) {
                    that.editor.execCommand("mll_command");
                } 
            });
            
            editor.on('ObjectResized', function(e) {
                if(e.target.nodeName == "IMG" && tinymce.activeEditor.dom.hasClass(e.target, "media_reference")) {
                    
                    var id = that.getShortcodeParam(e.target.title, 'id');
                    var path = that.getShortcodeParam(e.target.title, 'path');
                    var link = that.getShortcodeParam(e.target.title, 'link');
                    
                    var attr = { link: link, path: path, width: e.target.width, height: e.target.height };
                    
                    var s = that.buildShortcode(id, attr);
                    e.target.title = s.substring(1, s.length - 1);
                }
                    
            });
            
            editor.on('BeforeSetContent', function(e){
                e.content = that._do_emb(e.content)
            });
                     
            editor.on('PostProcess', function(e){
                if (e.get) {
                    e.content = that._get_emb(e.content)
                }
            });
        },
        
        initTabs: function(){
            $("ul#tabs li", context).click(function(e){
                if (!$(this).hasClass("active")) {
                    var tabNum = $(this).index();
                    var nthChild = tabNum+1;
                    $("ul#tabs li.active", context).removeClass("active");
                    $(this).addClass("active");
                    $("ul#tab li.active", context).removeClass("active");
                    $("ul#tab li:nth-child("+nthChild+")", context).addClass("active");
                    that.onTabChanged(tabNum, context);
                }
            });

            $("ul#tabs li", context).first().trigger('click');
        },

        onTabChanged: function(index){
            $mediaContainer = $('#mediaContainer', context);
            $mediaContainer.html('');

            switch(index) {
                case 0:
                    $('#mll-noselect', context).html('<p>No Media selected yet</p>');

                    if($('#search', context).val() != '' && that.lastResult.length > 0) {
                        that.showSearchResult(that.lastResult);
                    } else {
                        $mediaContainer.append('<p style="text-align:center;">Use the search textbox and press enter to find your image</p>');
                        $mediaContainer.append('<p style="text-align:center;">You can link the image to various media files by using the "Link to Image" button</p>');
                    }
                    break;
                case 1:
                    $('#file', context).val('');
                    $('#mll-select', context).hide();
                    $('#mll-noselect', context).html('<p style="text-align:center;">Press \'Select Files\' to upload new images</p>').show();
                    that.showFolders('');
                    break;
            }
        },

        /**
         * When dialog is displayed, initialize its content
         */
        initDialog: function(ctx){
            // set the current dialog context
            context = ctx;
            that.initTabs();

            $(context).focus();
            $(context).keydown(function(e){
                if(e.which == 27) that.editor.windowManager.close();
            });
            
            var selectedNode = that.editor.selection.getNode();
            if (selectedNode.nodeName == "IMG" && that.editor.dom.hasClass(selectedNode, "media_reference")) {
                var media_id = that.getShortcodeParam(selectedNode.title, "id");
                var link_id = that.getShortcodeParam(selectedNode.title, "link");
                var newwindow = that.getShortcodeParam(selectedNode.title, "newwindow");
                var width = that.getShortcodeParam(selectedNode.title, "width");
                var height = that.getShortcodeParam(selectedNode.title, "height");
                
                that.showMedia( media_id );
                
                that.MediaID(media_id);
                that.LinkID(link_id);
                that.LinkNewWindow(newwindow),
                that.ImageWidth(width);
                that.ImageHeight(height);
            }
            
            $("form", context).submit(function(event) {
                    event.preventDefault();
                    
                    var id = that.MediaID();
                    var attr = { 
                        link: that.LinkID(),
                        newwindow: that.LinkNewWindow(),
                        width: that.ImageWidth(),
                        height: that.ImageHeight(),
                    };
                    
                    that.insertShortcode( id, attr );
            });
            
            $('#search', context).keyup(function(e){ 
                var code = e.which;
                if(code==13) {
                    e.preventDefault();
                    that.searchMedia(context);
                }
            });
            $('#search', context).change(function(e){  that.searchMedia(); });
            
            $('#category', context).change(function(){ that.searchMedia(); });
            
            $('#file', context).change(function(){
                var files = $(this)[0].files;

                var title = "<p>Selected Files</p>";
                var fileStr = '';

                for(var i = 0; i < files.length; i++){
                    fileStr += '<div>'+ files[i]['name'] +'</div>';
                }

                $('#mll-noselect', context).html(title + fileStr);
            })

            $('#btnUpload', context).click(function(){
                var files = $('#file', context)[0].files;

                $('#mediaContainer', context).html('<p style="text-align: center;font-weight:bold;">Uploading...</p>');

                that.ajax_upload_media( files, that.curDir, function(response){
                    $('#file', context).val('');

                    console.log(response);
                    that.showSearchResult(response);
                    return;
                },
                function(evt){ that.showUploadProgress(evt); }
                );
            });

            $('#btnCreateFolder', context).click(function(){
                var name = $('#newFolder', context).val();
                if(name == '') return;

                that.ajax_create_folder(name).done(function(){
                    that.showFolders(that.curDir);
                });
            });

            // load categories
            that.ajax_taxonomy_get().done(function(list){
                $.each(list, function(k, o){
                    $('#category', context).append($('<option>', {value: o.term_id, text: o.name }) );
                });
            });
        },
        
        MediaID: function(id){
            if(context == null) return 'No context found';

            if(id == undefined)
                return $("#media_id", context).val();
            else 
                $("#media_id", context).val(id);
        },
        
        LinkID: function(id){
            if(context == null) throw 'No context found';

            if(id == undefined)
                return $("#link_id", context).val();
            else
                $("#link_id", context).val(id);
        },
        
        LinkNewWindow: function(b) {
            if(context == null) throw 'No context found';

            if(b == undefined)
                return $("#link_new", context).prop('checked');
            else
                $("#link_new", context).prop('checked', b);
        },
        
        ImageWidth: function(value) {
            if(context == null) throw 'No context found';

            if(value == undefined)
                return $("#img_width", context).val();
            else
                $("#img_width", context).val(value);
        },
        
        ImageHeight: function(value) {
            if(context == null) throw 'No context found';

            if(value == undefined)
                return $("#img_height", context).val();
            else
                $("#img_height", context).val(value);
        },
        
        showSearchResult: function(data){
            if(context == null) throw 'No context found';

            var $mediaContainer = $('#mediaContainer', context);
            $mediaContainer.html('');

            $.each(data, function(i, row) {
                // original image size
                var imgSrc = row['path'];
                if(row.hasOwnProperty('thumbnail'))
                    imgSrc = row['thumbnail'];
                
                if(imgSrc === undefined)
                    imgSrc = MLL_PLUGIN_URL + 'img/' + MLL_IMAGE_NOTFOUND;
                else
                    imgSrc = MLL_UPLOAD_URL + imgSrc;

                $mediaContainer.append( that._addImage(row, imgSrc, that.showMedia, that.LinkID) );
            });
        },

        _addImage: function(data, thumbnail, onClick, onLinkClick){
            var container = $("<div />");
            var img = $('<span />', { class: 'mll-thumbnail' });
            var imgtext = $('<span />', { class: 'mll-imagetext' });
            var titletext  = $('<p />', {text: 'No title'});
            var mimetext = $('<div />');
            var linktext = $('<a />', { href: 'javascript:void(0)',text: 'Link with Image' });

            img.appendTo(container);
            imgtext.appendTo(container);
            titletext.appendTo(imgtext);
            mimetext.appendTo(imgtext);
            linktext.appendTo(imgtext);

            img.css( 'background-image', 'url('+thumbnail+')' );
            if(data['exists'] != undefined) data['post_title']  += " [NOT UPDATED]";

            titletext.text( data['post_title'] );
            mimetext.text( data['post_mime_type']);

            titletext.click(function(){ onClick(data['ID']); });
            linktext.click(function() { onLinkClick(data['ID']) });
            return container;
        },
        
        searchMedia: function(){
            if(context == null) throw 'No context found';

            $('#mediaContainer', context).html('<p style="text-align: center">Loading...</p>');
            
            var search = $('#search', context).val();
            var category = parseInt($('#category', context).val());
            
            if(search.length < 3 && category <= 0) {
                $('#mediaContainer', context).html('<p style="text-align: center;color:red;">Please enter minimum 3 characters</p>');
                return;
            }
            
            that.ajax_search_media( search, $('#category', context).val() ).done(function(response){
                that.lastResult = response;
                that.showSearchResult(response);
            });
        },
        
        showMedia: function(id){
            if(context == null) throw 'No context found';

            that.MediaID(id);
            that.LinkID('');

            $('#mll-select',context).hide();
            $('#mll-noselect', context).show();
            $('#mll-noselect > p', context).text('Loading...');

            that.ajax_get_media(id).done(function(response){
                if(!response) {
                    $('#mll-noselect > p', context).text('Invalid media response from server');
                    return;
                }
                
                if(response['post_mime_type'].substring(0, 5) != 'image') {
                    $('#mll-noselect > p', context).text('Only images are supported');
                    return;
                }
                                
                $('#mll-select .mll-thumbnail', context).css('background-image', 'url('+ MLL_UPLOAD_URL + response['path'] +')');
                $('#mll-select .mll-imagetext', context).text(response['post_title']);
                
                $('#mll-noselect', context).hide();
                $('#mll-select',context).show();
            });
        },

        showUploadProgress: function(evt){
            if(context == null) return;

            if (evt.lengthComputable) {
                var percentComplete =evt.loaded / evt.total;

                percentComplete = parseInt(percentComplete * 100);
                
                $('#mediaContainer', context).html('<p style="text-align: center;font-weight: bold;">Uploading '+percentComplete+'%</p>');

                if (percentComplete >= 100) {
                    $('#mediaContainer', context).html('<p style="text-align: center">Upload complete<br />Please wait</p>');
                }
            }
        },

        showFolders: function(dir){
            if(context == null) throw 'No context found';

            var $mediaContainer = $('#mediaContainer', context); 
            $mediaContainer.html('');

            that.curDir = dir;

            var parentDir = dir.replace(/\/[^\/]+$/, '');

            $mediaContainer.append( that._addFolder('../', parentDir, function(path) {  that.showFolders(path);  }) );

            that.ajax_list_dirs(dir).done(function(response){
                for(var i in response) {
                    var name = response[i];
                    
                    $mediaContainer.append( that._addFolder(name, that.curDir + name, function(path) {  that.showFolders(path);  }) );
                }
            });

            $('#folderPath', context).text(that.curDir);
        },

        _addFolder: function(name, path, onclick) {
            var container = $("<div />");
            var img = $('<span />', { class: 'mll-thumbnail' });
            var imgtext = $('<span />', { class: 'mll-imagetext' });
            var titletext  = $('<p />', {text: 'No title'});
            
            img.appendTo(container);
            imgtext.appendTo(container);
            titletext.appendTo(imgtext);

            container.data('path', path);
            img.css({'width': '20px', 'height': '20px', 'background-image': 'url('+ MLL_PLUGIN_URL + 'img/' + MLL_FOLDER_CLOSE +')'});
            titletext.text(name);
            titletext.click( function() { onclick(container.data('path')); } );

            return container;
        },
               
        buildShortcode: function(id,attr){
            id = parseInt(id);
            var s = '[mediaref id=' + id;
            
            for(var key in attr){
                if(!attr.hasOwnProperty(key)) continue;
                var v = attr[key];
                if(v) s += ' ' + key + '=' + v;
            }
            s += ']';
            return s;
        },
        
        getShortcodeParam: function(s, name) {
            if(name == 'id' || name == 'link' || name == 'width' || name == 'height') {
                d = new RegExp(name + '=([0-9]+)').exec(s);
                return d ? parseInt(d[1]) : null;
            } else if(name == "newwindow") {
                d = new RegExp(name + '=(true|false)').exec(s);
                return (d != null && d[1] === 'true') ? true : false;
            } else if(name == "path") {
                d = new RegExp(name + "=\"?(.*?)\"?(\\s|$)").exec(s);
                return d ? d[1] : null;
            }
            return null;
        },
        
        insertShortcode: function(id, attr){
            that.ajax_get_media(id).done(function(response){
                attr['path'] = response['path'];
                // build the shortcode with attributes (incl. relative path)
                var shortcode = that.buildShortcode(id, attr);
                
                // replace or insert the shortcode into content editor
                that.editor.execCommand('mceInsertContent', false, shortcode);
                var all_content = that.editor.getContent();
                that.editor.setContent(all_content);
                that.editor.windowManager.close();
            });
        },
        
        /**
         * receive media information by passing its attachment_id containing: [ID, post_title, relative URL path]
         * @param {integer} id the attachment ID
         */
        ajax_get_media: function(id){
            var data = {'action': 'media_get', 'media_id': id};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * Ajax upload request using wordpress default action 'wp_handle_upload'
         * @param {File} f selected file from input tag
         * @param {function} callback on success returning the attachment id as parameter 1
         */
        ajax_upload_media: function(f, p, callback, progressCallback){
            var formData = new FormData();

            formData.append('action', 'wp_handle_upload');
            for(var i = 0; i < f.length; i++) {
                formData.append('file['+i+']', f[i]);
            }
            
            formData.append('path', p);
            
            jQuery.ajax({
                xhr: function(){
                    var xhr = $.ajaxSettings.xhr();
                    if($.isFunction(progressCallback)) xhr.upload.onprogress = progressCallback;
                    return xhr;
                },
                type: 'POST',
                url: ajaxurl,
                data: formData,
                cache:false,
                contentType: false,
                processData: false,
                dataType: 'json',
                success: callback
            });
        },
        
        /**
         * Ajax search request in media library
         * @param {string} filter query to search for media files
         */
        ajax_search_media: function(filter, category){
            var data = { 'action': 'media_search' };
            data['filter'] = filter;
            if(category != undefined)
                data['category'] = category;
            
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_list_dirs: function(){
            var data = {'action': 'media_list_dirs', 'dir': that.curDir};
            return jQuery.post(ajaxurl, data, null, 'json');
        },

        ajax_create_folder: function(name) {
            var data = {'action': 'media_create_folder', 'name': name, 'dir': that.curDir};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_taxonomy_get: function() {
            var data = {'action': 'taxonomy_get'};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _do_emb:function (ed) {
            return ed.replace(/\[mediaref([^\]]*)\]/g, function (d, e) {
                var imgSrc = MLL_PLUGIN_URL + "js" + MLL_IMAGE_NOTFOUND;
                
                var p = that.getShortcodeParam(e, 'path');
                if(p != undefined)
                    imgSrc = MLL_UPLOAD_URL + p;
                
                var w = that.getShortcodeParam(e, 'width');
                var h = that.getShortcodeParam(e, 'height');
                 
                return '<img src="' + imgSrc + '" width="'+w+'" height="'+h+'" class="media_reference mceItem" title="mediaref' + tinymce.DOM.encode(e) + '" />';
            })
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _get_emb:function (b) {
            function ed(c, d) {
                d = new RegExp(d + '="([^"]+)"', "g").exec(c);
                return d ? tinymce.DOM.decode(d[1]) : "";
            }
            return b.replace(/(?:<p[^>]*>)*(<img[^>]+>)(?:<\/p>)*/g, function (e, d) {
                var c = ed(d, "class");
                if (c.indexOf("media_reference") != -1) {
                    return "<p>[" + tinymce.trim(ed(d, "title")) + "]</p>"
                }
                return e
            })
        },
        
    });

    tinymce.PluginManager.add('mll_plugin', tinymce.plugins.mll_plugin);
})(jQuery);
